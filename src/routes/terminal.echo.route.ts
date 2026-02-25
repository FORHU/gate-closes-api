import express from "express";
const router = express.Router();

import TerminalEchoCtrl from "../controllers/terminal.echo.controller";

router.post("/audio", TerminalEchoCtrl.createAudio);
router.post("/text-message", TerminalEchoCtrl.createTextMessage);

export default router;

