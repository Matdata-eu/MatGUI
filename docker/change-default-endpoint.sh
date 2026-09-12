#!/bin/sh

# Set default value if the environment variable is not set
: ${MATGUI_DEFAULT_ENDPOINT:="https://dbpedia.org/sparql"}

# Replace the default endpoint in the bundle.js file
echo "Switching Matgui default endpoint to: $MATGUI_DEFAULT_ENDPOINT"
sed -i "s|https://change.to.default.endpoint/sparql|$(printf '%s' "$MATGUI_DEFAULT_ENDPOINT" | sed 's/[&/\]/\\&/g')|g" /usr/share/nginx/html/*.js

# Execute the command passed to the entrypoint
exec "$@"

# Execute the original Docker entrypoint script
exec /docker-entrypoint.sh