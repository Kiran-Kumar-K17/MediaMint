import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import videoRoutes from "./routes/video.routes.js";
import { Server } from "socket.io";
import { createServer } from "http";

dotenv.config();

const app = express();
app.use(
  cors({
    origin: "http://localhost:5173",
  }),
);
const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

app.set("io", io);
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use("/api/videos", videoRoutes);

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
