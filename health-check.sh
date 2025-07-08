#!/bin/bash
set -e  # Exit on any error

# In the original repository we'll just print the result of status checks,
# without committing. This avoids generating several commits that would make
# later upstream merges messy for anyone who forked us.
commit=true
origin=$(git remote get-url origin)
if [[ $origin == *statsig-io/statuspage* ]]
then
  commit=false
fi

KEYSARRAY=()
COMMAND_ARGS=()

urlsConfig="./urls.cfg"
echo "Reading $urlsConfig"

# Check if urls.cfg exists
if [[ ! -f "$urlsConfig" ]]; then
  echo "Error: $urlsConfig not found!"
  exit 1
fi

while read -r line
do
  # Skip empty lines and comments
  if [[ -z "$line" || "$line" =~ ^#.* ]]; then
    continue
  fi
  
  echo "  $line"
  IFS='=' read -ra TOKENS <<< "$line"
  KEYSARRAY+=("${TOKENS[0]}")
  COMMAND_ARGS+=("$(eval echo "${TOKENS[1]}")")
done < "$urlsConfig"

echo "***********************"
echo "Starting health checks with ${#KEYSARRAY[@]} configs:"

mkdir -p logs

for (( index=0; index < ${#KEYSARRAY[@]}; index++))
do
  key="${KEYSARRAY[index]}"
  args="$(echo ${COMMAND_ARGS[index]})"

  echo "  $key=$args"
  
  for i in 1 2 3 4; 
  do
    cmd="curl --write-out '%{http_code}' --silent --output /dev/null --max-time 30 $args"
    echo "    Attempt $i: Running $cmd"
    response=$(eval "$cmd" | tee)
    echo "    Response: $response"
    
    if [ "$response" -eq 200 ] || [ "$response" -eq 202 ] || [ "$response" -eq 301 ] || [ "$response" -eq 307 ]; then
      result="success"
    else
      result="failed"
    fi
    
    echo "    Result: $result"
    
    if [ "$result" = "success" ]; then
      break
    fi
    sleep 5
  done
  
  dateTime=$(date +'%Y-%m-%d %H:%M')
  if [[ $commit == true ]]
  then
    echo $dateTime, $result >> "logs/${key}_report.log"
    # By default we keep 10000 last log entries.  Feel free to modify this to meet your needs.
    echo "$(tail -10000 logs/${key}_report.log)" > "logs/${key}_report.log"
  else
    echo "    $dateTime, $result"
  fi
done

if [[ $commit == true ]]
then
  # Configure git for GitHub Actions
  git config --global user.name 'github-actions[bot]'
  git config --global user.email 'github-actions[bot]@users.noreply.github.com'
  
  # Check if there are any changes to commit
  if [[ -n $(git status --porcelain) ]]; then
    echo "Changes detected, committing and pushing..."
    git add -A --force logs/
    git commit -am '[Automated] Update Health Check Logs'
    git push
  else
    echo "No changes to commit."
  fi
fi
