CREATE TABLE `plan_checks` (
	`plan_id` text NOT NULL,
	`course_code` text NOT NULL,
	`item_text` text NOT NULL,
	`answer` text NOT NULL,
	PRIMARY KEY(`plan_id`, `course_code`, `item_text`)
);
