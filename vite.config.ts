import { defineConfig, loadEnv } from "vite";
import dyadComponentTagger from "@dyad-sh/react-vite-component-tagger";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');
  
  const port = parseInt(env.PORT || '8080');
  const host = env.HOST || '::';
  const allowedHosts = (env.ALLOWED_HOSTS || "")
    .split(",")
    .map(host => host.trim())
    .filter(Boolean);

  console.log(allowedHosts);

  return {
    server: {
      host: host,
      port: port,
      // Development server CORS
      cors: true,
      allowedHosts: allowedHosts,      
    },
    preview: {
      host: host,
      port: port,
      // Preview server CORS
      cors: true,
      allowedHosts: allowedHosts,       
    },
    dev: {
      host: host,
      port: port,
      // Preview server CORS
      cors: true,
      allowedHosts: allowedHosts,     
    },


    plugins: [dyadComponentTagger(), react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});