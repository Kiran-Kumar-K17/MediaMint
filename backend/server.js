import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import videoRoutes from "./routes/video.routes.js";

dotenv.config();

const app = express();
app.use(
  cors({
    origin: "http://localhost:5173",
  }),
);
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use("/api/videos", videoRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
