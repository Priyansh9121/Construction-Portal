const express = require("express");
const router = express.Router();

const siteController = require("./site.controller");

router.get("/", siteController.getSites);
router.post("/", siteController.createSite);
router.get("/:id", siteController.getSiteById);
router.put("/:id", siteController.updateSite);
router.delete("/:id", siteController.deleteSite);

module.exports = router;