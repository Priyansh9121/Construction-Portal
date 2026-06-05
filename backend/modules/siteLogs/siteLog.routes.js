const express = require("express");
const router = express.Router();

const siteLogController = require("./siteLog.controller");

router.get("/", siteLogController.getSiteLogs);
router.post("/", siteLogController.createSiteLog);
router.delete("/:id", siteLogController.deleteSiteLog);

module.exports = router;