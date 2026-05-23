import { Router } from "express";
import {
  getVideoInfo,
  downloadVideo,
  cancelDownload,
} from "../controllers/video.controller.js";

const router = Router();

router.post("/info", getVideoInfo);
router.post("/download", downloadVideo);
router.post("/cancel", cancelDownload);

export default router;
