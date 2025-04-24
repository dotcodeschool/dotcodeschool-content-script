# DotCodeSchool Content Generator

A tool that converts Git repositories using the [Gitorial format](https://github.com/gitorial-sdk) into structured course content and uploads it to Contentful CMS.

## What is Gitorial?

Gitorial is a Git-based tutorial format where each step of a tutorial is represented by commits in a special `gitorial` branch. The commits follow a specific structure to create an interactive, step-by-step learning experience.

## How it Works

1. Clones a repository and processes its `gitorial` branch
2. Converts commit history into organized lessons and sections
3. Generates diff files to show changes between steps
4. Creates markdown files with proper formatting
5. Uploads everything to Contentful as structured course content

## Setup

1. Clone this repository
```bash
git clone https://github.com/dotcodeschool/dotcodeschool-content-script.git
```
2. Install dependencies:
```bash
pnpm install
```
3. Create a `.env` file with:
```
CONTENTFUL_SPACE_ID=your_space_id
CONTENTFUL_ENVIRONMENT=your_environment
CONTENTFUL_MANAGEMENT_ACCESS_TOKEN=your_token
PARENT_DIR=gitorial_repository_name
```

## Usage

1. Process a Gitorial repository:
```bash
pnpm start <github-repository-url>
```

2. Upload to Contentful:
```bash
pnpm upload
```

## Gitorial Format

Commits in the `gitorial` branch should follow these prefixes:

- `starting-template:` - Initial project setup (skipped in processing)
- `section:` - Creates a new course section
- `template:` - Provides starter code for an exercise
- `solution:` - Shows the solution to the exercise
- `action:` - Regular tutorial step
- `readme:` - Documentation/explanation

Each commit's README.md contains the lesson content, and the code changes in the commit represent the step's modifications.

## Example Repository

See [rust-state-machine](https://github.com/shawntabrizi/rust-state-machine) for an example of a properly formatted Gitorial repository.