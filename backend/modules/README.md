# Backend Modules

This folder contains feature-based backend modules.

Each module should contain its own:

- routes
- controller
- service logic
- validation logic later

## Current Modules

- auth
- payments
- workers
- sites
- tenders
- invoices
- siteLogs
- workerMoney
- uploads

## Current Pattern

Example:

payments/
- payment.routes.js
- payment.controller.js

## Future Pattern

As the project grows, each module should become:

payments/
- payment.routes.js
- payment.controller.js
- payment.service.js
- payment.validation.js

## Purpose

This structure keeps the backend scalable as the construction portal grows into:

- tender details
- subcontractors
- material tracking
- banking
- approvals
- documents
- activity logs
- permissions