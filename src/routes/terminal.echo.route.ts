import express from "express";
const router = express.Router();

import TerminalEchoCtrl from "../controllers/terminal.echo.controller";

router.get("/", TerminalEchoCtrl.search);
router.post("/", TerminalEchoCtrl.create);

export default router;

