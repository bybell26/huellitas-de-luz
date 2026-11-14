# Front estatico para Railway (root directory: /Front)
FROM python:3.12-alpine
WORKDIR /site
COPY . .
CMD ["sh","-c","exec python -m http.server ${PORT:-8080} --bind 0.0.0.0"]