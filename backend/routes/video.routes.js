import { Router } from "express";
import { getVideoInfo } from "../controllers/video.controller.js";

const router = Router();

router.post("/info", getVideoInfo);
//router.post("/download", downloadVideo);

export default router;
