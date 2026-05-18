-- Shift daily signup uniqueness from (user, base, work_date) to (user, job, work_date)
-- so same-day non-overlapping jobs across bases (or within a base) can be modeled.

ALTER TABLE `daily_signup`
  DROP INDEX `UQ_daily_signup_user_base_date`;

ALTER TABLE `daily_signup`
  ADD UNIQUE KEY `UQ_daily_signup_user_job_date` (`user_id`, `job_id`, `work_date`);
