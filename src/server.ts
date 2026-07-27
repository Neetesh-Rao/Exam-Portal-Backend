import express from "express";
import http from "http";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { Server as SocketIOServer } from "socket.io";
import { connectToDatabase } from "./config/db.js";

import authRoutes from "./routes/auth.routes.js";
import testsRoutes from "./routes/tests.routes.js";
import questionsRoutes from "./routes/questions.routes.js";
import submissionsRoutes from "./routes/submissions.routes.js";
import candidatesRoutes from "./routes/candidates.routes.js";
import candidateTestsRoutes from "./routes/candidateTests.routes.js";
import invitesRoutes from "./routes/invites.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import notificationsRoutes from "./routes/notifications.routes.js";
import liveMonitorRoutes from "./routes/liveMonitor.routes.js";
import healthRoutes from "./routes/health.routes.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

// Socket.io initialization
const io = new SocketIOServer(server, {
  cors: {
    origin: [CLIENT_URL, "http://localhost:3000", "http://127.0.0.1:3000", "*"],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("join-room", (roomId: string) => {
    socket.join(roomId);
    console.log(`Socket ${socket.id} joined room ${roomId}`);
  });

  socket.on("leave-room", (roomId: string) => {
    socket.leave(roomId);
  });

  socket.on("proctor-event", (data: any) => {
    if (data.roomId) {
      socket.to(data.roomId).emit("proctor-alert", data);
    }
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

// Middlewares
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests from all origins in production or match CLIENT_URL
      callback(null, true);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());

// Connect to MongoDB Database
connectToDatabase().catch((err) => console.error("Database connection failure:", err));

// Root Health & Welcome Routes (for browser testing)
app.get("/", (req, res) => {
  res.json({
    status: "online",
    message: "🚀 Exam Portal Express API Backend is running successfully!",
    health: "/api/health",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api", (req, res) => {
  res.json({
    status: "online",
    message: "🚀 Exam Portal Express API Backend is running successfully!",
    endpoints: [
      "/api/health",
      "/api/auth",
      "/api/tests",
      "/api/questions",
      "/api/submissions",
      "/api/candidates",
      "/api/invites",
      "/api/analytics",
      "/api/notifications",
      "/api/live-monitor",
    ],
    timestamp: new Date().toISOString(),
  });
});

// Mount REST API routes
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/tests", testsRoutes);
app.use("/api/questions", questionsRoutes);
app.use("/api/submissions", submissionsRoutes);
app.use("/api/candidates", candidatesRoutes);
app.use("/api/candidate", candidateTestsRoutes);
app.use("/api/invites", invitesRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/live-monitor", liveMonitorRoutes);

if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  server.listen(PORT, () => {
    console.log(`🚀 Express Backend Server running on http://localhost:${PORT}`);
  });
}

export default app;
