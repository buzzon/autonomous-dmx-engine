// Vite configuration for DMX Engine UI Phase 3
// Optimized for performance and bundle size

import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'src/control/webui',
  publicDir: '../../public',
  
  // Build optimization
  build: {
    outDir: '../../../dist/webui',
    emptyOutDir: true,
    target: 'es2020',
    
    // Minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.debug', 'console.log'],
      },
      format: {
        comments: false,
      },
    },
    
    // Source maps for production debugging
    sourcemap: process.env.NODE_ENV === 'production' ? 'hidden' : true,
    
    // Bundle optimization
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/control/webui/index.html'),
      },
      output: {
        // Code splitting
        manualChunks: {
          'vendor-imgui': ['@zhobo63/imgui-ts'],
          'vendor-socket': ['socket.io-client'],
          'vendor-utils': ['lodash', 'uuid'],
          'components-visualization': [
            './src/control/webui/components/visualization/SpectrumVisualizer.ts',
            './src/control/webui/components/visualization/WaveformView.ts',
            './src/control/webui/components/visualization/MeterComponent.ts',
            './src/control/webui/components/visualization/DMXChannelGrid.ts',
          ],
          'pages-editors': [
            './src/control/webui/pages/SceneEditor.ts',
            './src/control/webui/pages/EffectEditor.ts',
            './src/control/webui/pages/FixtureManager.ts',
            './src/control/webui/pages/RuleEditor.ts',
          ],
        },
        // Tree shaking friendly
        exports: 'named',
        // Better chunk naming
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    
    // Performance optimizations
    chunkSizeWarningLimit: 1000, // 1MB warning limit
    reportCompressedSize: true,
    
    // CSS optimization
    cssCodeSplit: true,
    cssMinify: true,
  },
  
  // Development server
  server: {
    port: 3000,
    open: true,
    host: true,
    fs: {
      strict: false,
      allow: ['..', '../..', '../../..'],
    },
    proxy: {
      '/ws': {
        target: 'http://localhost:8080',
        ws: true,
      },
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
    // HMR optimization
    hmr: {
      overlay: true,
    },
  },
  
  // Preview server
  preview: {
    port: 3001,
    host: true,
  },
  
  // Dependency optimization
  optimizeDeps: {
    include: [
      '@zhobo63/imgui-ts',
      'socket.io-client',
    ],
    exclude: [
      // Exclude large dependencies from pre-bundling
    ],
    // Force dependency pre-bundling
    force: true,
  },
  
  // Resolve configuration
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/control/webui/components'),
      '@pages': resolve(__dirname, 'src/control/webui/pages'),
      '@store': resolve(__dirname, 'src/control/webui/store'),
      '@utils': resolve(__dirname, 'src/control/webui/utils'),
      '@types': resolve(__dirname, 'src/control/webui/types'),
    },
    // Extensions to try when resolving imports
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },
  
  // Plugin configuration
  plugins: [
    // Custom plugin for Phase 3 optimizations
    {
      name: 'phase3-optimizations',
      configResolved(config) {
        if (config.command === 'build') {
          console.log('🚀 Phase 3 UI Build Optimization Enabled');
          console.log('📦 Target: ES2020');
          console.log('🔧 Minification: Terser with console removal');
          console.log('🧩 Code splitting: Vendor + Feature chunks');
        }
      },
    },
  ],
  
  // Environment variables
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '3.0.0'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __PHASE__: JSON.stringify('3'),
  },
  
  // Log level
  logLevel: 'info',
  
  // Clear screen on restart
  clearScreen: true,
});