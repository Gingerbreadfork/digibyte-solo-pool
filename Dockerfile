FROM node:20-alpine

# Create non-root user for security
RUN addgroup -g 1001 -S pooluser && \
    adduser -u 1001 -S pooluser -G pooluser

WORKDIR /app

# Copy files with correct ownership
COPY --chown=pooluser:pooluser package.json ./
COPY --chown=pooluser:pooluser src ./src

# Ensure runtime-writable app directory (for stats persistence under /app/data).
RUN chown -R pooluser:pooluser /app

# Switch to non-root user
USER pooluser

ENV NODE_ENV=production

EXPOSE 3333/tcp 8080/tcp

CMD ["node", "src/index.js"]
