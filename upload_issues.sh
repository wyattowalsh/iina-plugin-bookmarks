#!/usr/bin/env zsh

REPO="wyattowalsh/iina-plugin-bookmarks"
PROJECT_ID="PVT_kwHOAJlxQ84A6uGf"
ISSUES_DIR="./issues"
TEMP_DIR="./.issue-cache"

mkdir -p "$TEMP_DIR"
echo "" > "$TEMP_DIR/summary.log"

REPO_ID=$(gh repo view "$REPO" --json id -q .id)

print "🏷️  Ensuring all required labels exist..."

# Define labels and their colors
label_names=("enhancement" "subtask" "UI" "settings" "import/export" "keyboard" "metadata" "filtering" "sorting" "search" "accessibility" "performance" "i18n" "markdown" "backup" "collaboration" "testing" "docs" "error handling" "responsive")
label_colors=("84b6eb" "d4c5f9" "fbca04" "bfdadc" "f7c6c7" "5319e7" "cc317c" "1d76db" "ededed" "0052cc" "e4e669" "c5def5" "0e8a16" "e99695" "5319e7" "5319e7" "fef2c0" "d93f0b" "bfe5bf" "c2e0c6")

for i in {1..$#label_names}; do
  name="$label_names[$i]"
  color="$label_colors[$i]"
  if ! gh label list --repo "$REPO" | grep -q "^$name"; then
    gh label create "$name" --color "$color" --repo "$REPO" --description "$name label"
  fi
done

print "🔁 Creating issues for $REPO (project: $PROJECT_ID)..."

for file in "$ISSUES_DIR"/*.md; do
  TITLE=$(grep '^# ' "$file" | sed 's/^# //')
  BODY=$(awk '!/^## Tasks/{print}' "$file" | tail -n +2)
  TASKS=$(awk '/^## Tasks/{flag=1; next} /^## Acceptance Criteria/{flag=0} flag' "$file" | grep '^- \[ \]')
  LABELS=("enhancement")

  print "📌 Creating parent issue: $TITLE"

  PARENT_JSON=$(gh api graphql -f query='
    mutation($repo: ID!, $title: String!, $body: String!) {
      createIssue(input: {
        repositoryId: $repo,
        title: $title,
        body: $body
      }) {
        issue {
          id
          number
          url
        }
      }
    }' \
    -f repo="$REPO_ID" \
    -f title="$TITLE" \
    -f body="$BODY" \
    --jq '.data.createIssue.issue')

  if [[ -z "$PARENT_JSON" || "$PARENT_JSON" == "null" ]]; then
    print "❌ Failed to create issue for '$TITLE'. Skipping..."
    continue
  fi

  PARENT_ID=$(echo "$PARENT_JSON" | jq -r '.id')
  if [[ "$PARENT_ID" == "null" ]]; then
    print "❌ Could not extract parent issue ID. JSON: $PARENT_JSON"
    continue
  fi

  PARENT_NUM=$(echo "$PARENT_JSON" | jq -r '.number')
  PARENT_URL=$(echo "$PARENT_JSON" | jq -r '.url')

  print "   → #$PARENT_NUM created at $PARENT_URL" | tee -a "$TEMP_DIR/summary.log"

  # Add parent to project
  gh api graphql -f query='
    mutation($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: {
        projectId: $projectId,
        contentId: $contentId
      }) {
        item {
          id
        }
      }
    }' \
    -f projectId="$PROJECT_ID" \
    -f contentId="$PARENT_ID"

  # Create sub-issues (tasks)
  echo "$TASKS" | while read -r line; do
    SUBTITLE=$(echo "$line" | sed -E 's/^- \[ \] //')
    print "   ↳ Creating subtask: $SUBTITLE"

    SUB_JSON=$(gh api graphql -f query='
      mutation($repo: ID!, $title: String!) {
        createIssue(input: {
          repositoryId: $repo,
          title: $title
        }) {
          issue {
            id
            number
            url
          }
        }
      }' \
      -f repo="$REPO_ID" \
      -f title="$SUBTITLE" \
      --jq '.data.createIssue.issue')

    if [[ -z "$SUB_JSON" || "$SUB_JSON" == "null" ]]; then
      print "⚠️ Failed to create subtask for '$SUBTITLE'. Skipping..."
      continue
    fi

    SUB_NUM=$(echo "$SUB_JSON" | jq -r '.number')
    SUB_ID=$(echo "$SUB_JSON" | jq -r '.id')
    SUB_URL=$(echo "$SUB_JSON" | jq -r '.url')

    if [[ "$SUB_ID" == "null" ]]; then
      print "⚠️ Could not extract subtask ID for '$SUBTITLE'. JSON: $SUB_JSON"
      continue
    fi

    # Append task reference to parent issue (workaround: fetch old body, append new)
    OLD_BODY=$(gh issue view "$PARENT_NUM" --repo "$REPO" --json body -q .body)
    NEW_BODY="$OLD_BODY
- [ ] #$SUB_NUM"
    echo "$NEW_BODY" | gh issue edit "$PARENT_NUM" --repo "$REPO" --body -

    # Append backlink to subtask
    gh issue comment "$SUB_NUM" --repo "$REPO" \
      --body "👈 Related to parent issue #$PARENT_NUM: $TITLE"

    # Add subtask to project
    gh api graphql -f query='
      mutation($projectId: ID!, $contentId: ID!) {
        addProjectV2ItemById(input: {
          projectId: $projectId,
          contentId: $contentId
        }) {
          item {
            id
          }
        }
      }' \
      -f projectId="$PROJECT_ID" \
      -f contentId="$SUB_ID"

    print "      ↳ Subtask #$SUB_NUM created at $SUB_URL" | tee -a "$TEMP_DIR/summary.log"
  done

  sleep 1  # GitHub API rate limits protection

done

print "\n📄 Summary written to $TEMP_DIR/summary.log"
cat "$TEMP_DIR/summary.log"
