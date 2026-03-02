// Vite configuration for DMX Engine UI
// Simple configuration without imports for now

export default {
  root: 'src/control/webui',
  publicDir: '../../public',
  build: {
    outDir: '../../../dist/webui',
    emptyOutDir: true,
    target: 'es2020',
    minify: 'terser',
    sourcemap: true,
  },
  server: {
    port: 3000,
    open: true,
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
  },
  optimizeDeps: {
    include: ['@zhobo63/imgui-ts', 'socket.io-client'],
  },
};