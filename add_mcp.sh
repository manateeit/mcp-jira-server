# Export environment variables (replace with your actual values)
export JIRA_HOST="https://your-domain.atlassian.net"
export JIRA_EMAIL="your-email@example.com"
export JIRA_API_TOKEN="your-api-token-here"
export JIRA_DEFAULT_PROJECT="YOUR-PROJECT"

# Run Claude Code with the MCP server
npm install 
npm run build
cd ./dist
node index.js