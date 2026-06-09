import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

// Create app exported for Vercel
export const app = express();
const PORT = 3000;

async function startServer() {
  // Use JSON middleware for API bodies
  app.use(express.json());

  const recentEntries: Array<any> = [];

  // API Routes
  app.post("/api/register", async (req, res) => {
    try {
      const { name, contactType, contactValue, mac, ip } = req.body;
      
      console.log(`[Registro Portal Cautivo] Nombre: ${name}, ${contactType}: ${contactValue}, MAC: ${mac}, IP: ${ip}`);

      const newEntry = {
        timestamp: new Date().toISOString(),
        name,
        contactType,
        contactValue,
        mac: mac || 'N/A',
        ip: ip || 'N/A'
      };

      recentEntries.unshift(newEntry);
      if (recentEntries.length > 5) {
        recentEntries.pop();
      }

      const webhookUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL;
      
      // If a webhook is configured in the environment variables, send the data there
      if (webhookUrl && webhookUrl.startsWith('http')) {
        try {
          const response = await fetch(webhookUrl, {
            method: 'POST',
            body: JSON.stringify(newEntry),
            headers: { 'Content-Type': 'application/json' },
          });
          
          if (!response.ok) {
            console.error("Error al enviar datos al Google Sheet webhook:", response.statusText);
          } else {
            console.log("Datos guardados en Google Sheets exitosamente.");
          }
        } catch (fetchErr) {
          console.error("Fallo de conexión enviando a webhook:", fetchErr);
        }
      }

      // We always return success to the portal so the user can continue logging in
      res.json({ success: true, message: "Registro completado" });
    } catch (error) {
      console.error("Error procesando registro:", error);
      res.status(500).json({ success: false, error: "Error interno del servidor" });
    }
  });

  app.get("/api/recent-entries", (req, res) => {
    res.json(recentEntries);
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve the compiled dist folder
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Don't listen on ports when running as a Vercel Serverless Function
  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  }
}

startServer();
