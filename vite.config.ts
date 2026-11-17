import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      sourcemap: false,
      reportCompressedSize: false,
      minify: 'esbuild' as const,
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        maxParallelFileOps: 3,
        output: {
          manualChunks(id: string) {
            const normalized = id.replace(/\\/g, '/');
            if (!normalized.includes('/node_modules/')) return;
            if (normalized.includes('/node_modules/recharts/') || normalized.includes('/node_modules/d3-')) {
              return 'vendor-recharts';
            }
            if (normalized.includes('/node_modules/lucide-react/')) {
              return 'vendor-lucide';
            }
            if (
              normalized.includes('/node_modules/react/') ||
              normalized.includes('/node_modules/react-dom/') ||
              normalized.includes('/node_modules/react-is/') ||
              normalized.includes('/node_modules/scheduler/')
            ) {
              return 'vendor-react';
            }
          },
        },
      },
    },
    server: {
      // Render पर डोमेन ब्लॉक होने की एरर को ठीक करने के लिए
      allowedHosts: true as true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
