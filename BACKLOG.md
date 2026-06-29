# Wishboard Backlog

This document tracks feature requests, technical debt, and future improvements that are planned but not yet implemented.

## Infrastructure & DevOps

- **Automated Database Backups**
  - **Description**: Implement a backup procedure to periodically snapshot the SQLite database (and optionally user-uploaded images in S3) to prevent data loss in the event of accidental stack deletion or corruption.
  - **Environment**: Production serverless deployments.
  - **Notes**: For the serverless AWS stack, we could leverage AWS Backup for the EFS file system, or schedule a Lambda function to copy the SQLite `.db` file to a dedicated backup S3 bucket on a cron schedule.
