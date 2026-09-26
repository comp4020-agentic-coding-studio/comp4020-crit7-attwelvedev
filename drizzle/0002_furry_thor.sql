CREATE TABLE `course_offerings` (
	`course_code` text NOT NULL,
	`year` integer NOT NULL,
	`session` text NOT NULL,
	PRIMARY KEY(`course_code`, `year`, `session`)
);
--> statement-breakpoint
CREATE TABLE `course_requisites` (
	`course_code` text NOT NULL,
	`req_type` text NOT NULL,
	`expression` text NOT NULL,
	`raw_text` text NOT NULL,
	`notes` text NOT NULL,
	PRIMARY KEY(`course_code`, `req_type`)
);
--> statement-breakpoint
CREATE TABLE `courses` (
	`code` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`units` integer NOT NULL,
	`level` integer NOT NULL,
	`description` text NOT NULL,
	`url` text NOT NULL,
	`is_tdp` integer DEFAULT 0 NOT NULL,
	`two_semester` integer DEFAULT 0 NOT NULL,
	`is_stub` integer DEFAULT 0 NOT NULL,
	`scraped_at` text NOT NULL,
	`parse_status` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `plan_choices` (
	`plan_id` text NOT NULL,
	`group_id` text NOT NULL,
	`child_id` text NOT NULL,
	PRIMARY KEY(`plan_id`, `group_id`)
);
--> statement-breakpoint
CREATE TABLE `plan_courses` (
	`plan_id` text NOT NULL,
	`course_code` text NOT NULL,
	`term_index` integer NOT NULL,
	`pinned_group_id` text,
	PRIMARY KEY(`plan_id`, `course_code`)
);
--> statement-breakpoint
CREATE TABLE `plans` (
	`id` text PRIMARY KEY NOT NULL,
	`program_code` text NOT NULL,
	`cohort_year` integer NOT NULL,
	`start_session` text NOT NULL,
	`cutoff` integer DEFAULT 0 NOT NULL,
	`read_only` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `program_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`program_code` text NOT NULL,
	`label` text NOT NULL,
	`bound` text NOT NULL,
	`units` integer NOT NULL,
	`filter` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `programs` (
	`code` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`year` integer NOT NULL,
	`total_units` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `requirement_courses` (
	`group_id` text NOT NULL,
	`course_code` text NOT NULL,
	PRIMARY KEY(`group_id`, `course_code`)
);
--> statement-breakpoint
CREATE TABLE `requirement_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`program_code` text NOT NULL,
	`parent_id` text,
	`label` text NOT NULL,
	`kind` text NOT NULL,
	`rule_type` text NOT NULL,
	`units_required` integer NOT NULL,
	`units_max` integer,
	`selectable` integer DEFAULT 0 NOT NULL,
	`sort_order` integer NOT NULL,
	`filter` text
);
