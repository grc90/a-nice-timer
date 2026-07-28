import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],

  /**
   * Puerto fijo, y que falle si está ocupado.
   *
   * No es capricho: el login con Google valida la URL de retorno contra una lista
   * blanca de coincidencia exacta en Supabase. Vite, por defecto, si encuentra el
   * puerto ocupado se corre al siguiente en silencio — y ahí el origen deja de
   * estar en la lista y el login falla con un error que no menciona el puerto por
   * ningún lado. Mejor que reviente al arrancar, cuando la causa es obvia.
   */
  server: {
    port: 5177,
    strictPort: true,
  },

  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
});
