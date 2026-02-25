import express from "express";
const router = express.Router();
import sessionMiddleware from "../middleware/valid-session.middleware";
import TerminalEchoCtrl from "../controllers/terminal.echo.controller";

router.post("/", sessionMiddleware, TerminalEchoCtrl.create);

export default router;

