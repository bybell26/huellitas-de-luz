# API Mascotas Solidarias para Railway (root directory: /Back/MascotasSolidarias)
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY src/Mascotas.Api/Mascotas.Api.csproj src/Mascotas.Api/
RUN dotnet restore src/Mascotas.Api/Mascotas.Api.csproj
COPY src/ src/
RUN dotnet publish src/Mascotas.Api/Mascotas.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .
# Railway define PORT en tiempo de ejecucion.
CMD ["sh","-c","ASPNETCORE_URLS=http://0.0.0.0:${PORT:-8080} exec dotnet Mascotas.Api.dll"]