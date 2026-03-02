import { ConfigLoader } from '../../../src/utils/config';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs/promises
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  access: jest.fn(),
  unlink: jest.fn(),
  mkdir: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn(),
}));

// Mock path
jest.mock('path', () => ({
  dirname: jest.fn(),
  join: jest.fn(),
  resolve: jest.fn(),
}));

describe('ConfigLoader', () => {
  let configLoader: ConfigLoader;
  const mockFs = fs as jest.Mocked<typeof fs>;
  const mockPath = path as jest.Mocked<typeof path>;

  beforeEach(() => {
    jest.clearAllMocks();
    configLoader = new ConfigLoader();
    
    // Default mock implementations
    mockPath.dirname.mockImplementation((p: string) => '/test/dir');
    mockPath.join.mockImplementation((...args) => args.join('/'));
    mockPath.resolve.mockImplementation((...args) => args.join('/'));
  });

  describe('load', () => {
    it('should load config from file and cache it', async () => {
      const mockConfig = { foo: 'bar' };
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockConfig));
      mockFs.stat.mockResolvedValue({ mtimeMs: 1000 } as any);

      const result = await configLoader.load<typeof mockConfig>('/test/config.json');
      
      expect(mockFs.stat).toHaveBeenCalledWith('/test/config.json');
      expect(mockFs.readFile).toHaveBeenCalledWith('/test/config.json', 'utf-8');
      expect(result).toEqual(mockConfig);
      
      // Second call should use cache
      const result2 = await configLoader.load<typeof mockConfig>('/test/config.json');
      expect(mockFs.readFile).toHaveBeenCalledTimes(1);
      expect(result2).toEqual(mockConfig);
    });

    it('should throw error when file cannot be read', async () => {
      mockFs.stat.mockResolvedValue({ mtimeMs: 1000 } as any);
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      
      await expect(configLoader.load('/test/config.json')).rejects.toThrow('File not found');
    });
  });

  describe('loadWithInheritance', () => {
    it('should load config without inheritance', async () => {
      const mockConfig = { foo: 'bar' };
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockConfig));

      const result = await configLoader.loadWithInheritance('/test/config.json');
      
      expect(result).toEqual(mockConfig);
    });

    it('should load config with inheritance', async () => {
      const baseConfig = { base: 'value', common: 'base' };
      const childConfig = { extends: 'base.json', common: 'child', extra: 'data' };
      
      mockFs.readFile
        .mockResolvedValueOnce(JSON.stringify(childConfig))
        .mockResolvedValueOnce(JSON.stringify(baseConfig));
      
      mockPath.resolve.mockReturnValue('/test/base.json');
      
      const result = await configLoader.loadWithInheritance('/test/child.json');
      
      // Should merge base and child, with child overriding
      expect(result).toEqual({ base: 'value', common: 'child', extra: 'data' });
    });

    it('should cache inherited config', async () => {
      const baseConfig = { base: 'value' };
      const childConfig = { extends: 'base.json' };
      
      mockFs.readFile
        .mockResolvedValueOnce(JSON.stringify(childConfig))
        .mockResolvedValueOnce(JSON.stringify(baseConfig));
      
      mockPath.resolve.mockReturnValue('/test/base.json');
      
      await configLoader.loadWithInheritance('/test/child.json');
      
      // Second call should use cache
      mockFs.readFile.mockClear();
      await configLoader.loadWithInheritance('/test/child.json');
      
      // Should not call readFile again
      expect(mockFs.readFile).not.toHaveBeenCalled();
    });
  });

  describe('fileExists', () => {
    it('should return true when file exists', async () => {
      mockFs.access.mockResolvedValue(undefined);
      
      const exists = await configLoader.fileExists('/test/file.json');
      
      expect(exists).toBe(true);
      expect(mockFs.access).toHaveBeenCalledWith('/test/file.json');
    });

    it('should return false when file does not exist', async () => {
      mockFs.access.mockRejectedValue(new Error('ENOENT'));
      
      const exists = await configLoader.fileExists('/test/file.json');
      
      expect(exists).toBe(false);
    });
  });

  describe('saveJson', () => {
    it('should save JSON to file', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      
      const data = { test: 'data' };
      await configLoader.saveJson('/test/dir/file.json', data);
      
      expect(mockFs.mkdir).toHaveBeenCalledWith('/test/dir', { recursive: true });
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/test/dir/file.json',
        JSON.stringify(data, null, 2),
        'utf-8'
      );
    });
  });

  describe('deleteFile', () => {
    it('should delete file', async () => {
      mockFs.unlink.mockResolvedValue(undefined);
      
      await configLoader.deleteFile('/test/file.json');
      
      expect(mockFs.unlink).toHaveBeenCalledWith('/test/file.json');
    });
  });

  describe('listFiles', () => {
    it('should list files in directory', async () => {
      mockFs.readdir.mockResolvedValue(['file1.json', 'file2.json', 'ignore.txt'] as any);
      
      const files = await configLoader.listFiles('/test/dir');
      
      expect(files).toEqual(['/test/dir/file1.json', '/test/dir/file2.json', '/test/dir/ignore.txt']);
    });

    it('should filter files by pattern', async () => {
      mockFs.readdir.mockResolvedValue(['file1.json', 'file2.json', 'ignore.txt'] as any);
      
      const files = await configLoader.listFiles('/test/dir', /\.json$/);
      
      expect(files).toEqual(['/test/dir/file1.json', '/test/dir/file2.json']);
    });
  });

  describe('clearCache', () => {
    it('should clear config cache', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify({ test: 'data' }));
      mockFs.stat.mockResolvedValue({ mtimeMs: 1000 } as any);
      
      await configLoader.load('/test/config.json');
      expect(mockFs.readFile).toHaveBeenCalledTimes(1);
      
      configLoader.clearCache();
      
      // Should load again after cache clear
      await configLoader.load('/test/config.json');
      expect(mockFs.readFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('checkForUpdates', () => {
    it('should detect updated files', async () => {
      const mockStats = { mtimeMs: 1000 };
      mockFs.stat.mockResolvedValue(mockStats as any);
      
      // First load to populate cache
      mockFs.readFile.mockResolvedValue(JSON.stringify({ test: 'data' }));
      await configLoader.load('/test/config.json');
      
      // Simulate file modification
      mockFs.stat.mockResolvedValue({ mtimeMs: 2000 } as any);
      
      const updated = await configLoader.checkForUpdates(['/test/config.json']);
      
      expect(updated).toEqual(['/test/config.json']);
    });

    it('should return empty array when no updates', async () => {
      const mockStats = { mtimeMs: 1000 };
      mockFs.stat.mockResolvedValue(mockStats as any);
      mockFs.readFile.mockResolvedValue(JSON.stringify({ test: 'data' }));
      
      await configLoader.load('/test/config.json');
      
      // Same mtime
      mockFs.stat.mockResolvedValue({ mtimeMs: 1000 } as any);
      
      const updated = await configLoader.checkForUpdates(['/test/config.json']);
      
      expect(updated).toEqual([]);
    });
  });

  describe('validateConfig', () => {
    it('should validate config against schema', () => {
      const config = { name: 'test', value: 42 };
      const schema = {
        required: ['name', 'value'],
        properties: {
          name: { type: 'string' },
          value: { type: 'number' },
        },
      };
      
      const errors = configLoader.validateConfig(config, schema);
      
      expect(errors).toEqual([]);
    });

    it('should detect missing required fields', () => {
      const config = { name: 'test' };
      const schema = {
        required: ['name', 'value'],
      };
      
      const errors = configLoader.validateConfig(config, schema);
      
      expect(errors).toHaveLength(1);
      expect(errors[0].error).toContain('Missing required field: value');
    });

    it('should detect type mismatches', () => {
      const config = { name: 'test', value: 'not-a-number' };
      const schema = {
        properties: {
          value: { type: 'number' },
        },
      };
      
      const errors = configLoader.validateConfig(config, schema);
      
      expect(errors).toHaveLength(1);
      expect(errors[0].error).toContain('should be type number');
    });
  });
});