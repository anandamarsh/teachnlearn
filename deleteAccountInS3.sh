#!/usr/bin/env bash
set -euo pipefail

BUCKET="learn-n-teach"
BASE_PREFIX="client_data"

if [ $# -ne 1 ]; then
  echo "Usage: $0 <client_folder_or_prefix>"
  echo "Examples:"
  echo "  $0 jai_dot_sitnstudy_at_gmail_dot_com"
  echo "  $0 client_data/jai_dot_sitnstudy_at_gmail_dot_com"
  echo "  $0 client_data/jai_dot_sitnstudy_at_gmail_dot_com/"
  exit 1
fi

INPUT="$1"

# Normalize input:
# - remove leading s3://bucket/
INPUT="${INPUT#s3://$BUCKET/}"
# - remove trailing slash
INPUT="${INPUT%/}"

# If user passed only the folder name, prepend BASE_PREFIX
if [[ "$INPUT" != "$BASE_PREFIX/"* ]]; then
  PREFIX="$BASE_PREFIX/$INPUT/"
else
  PREFIX="$INPUT/"
fi

echo "⚠️  WARNING"
echo "This will PERMANENTLY delete ALL versions and delete markers under:"
echo "s3://$BUCKET/$PREFIX"
echo
read -p "Type Y to continue: " CONFIRM
if [ "$CONFIRM" != "Y" ]; then
  echo "Aborted."
  exit 0
fi

command -v jq >/dev/null 2>&1 || {
  echo "jq is required. Install with: brew install jq"
  exit 1
}

echo "Deleting versions + delete markers under $PREFIX ..."

aws s3api list-object-versions \
  --bucket "$BUCKET" \
  --prefix "$PREFIX" \
  --output json \
| jq -r '.Versions[]?, .DeleteMarkers[]? | @base64' \
| while read -r row; do
    obj=$(echo "$row" | base64 --decode)
    key=$(echo "$obj" | jq -r .Key)
    vid=$(echo "$obj" | jq -r .VersionId)

    echo "Deleting: $key (version $vid)"
    aws s3api delete-object \
      --bucket "$BUCKET" \
      --key "$key" \
      --version-id "$vid" >/dev/null
  done

echo "✅ Done."
echo "Verify with:"
echo "  aws s3 ls s3://$BUCKET/$PREFIX"

