FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["services/Events.Api/Events.Api.csproj", "services/Events.Api/"]
COPY ["shared/AuraEvents.Shared/AuraEvents.Shared.csproj", "shared/AuraEvents.Shared/"]
RUN dotnet restore "services/Events.Api/Events.Api.csproj"
COPY . .
WORKDIR "/src/services/Events.Api"
RUN dotnet build "Events.Api.csproj" -c $BUILD_CONFIGURATION -o /app/build

FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "Events.Api.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
# Trusts the NetFree filtering-proxy root CAs used on the dev network, so outbound HTTPS calls
# (e.g. to OpenAI) don't fail chain validation inside the container the way they would otherwise.
COPY certs/netfree-ca-bundle.pem /usr/local/share/ca-certificates/netfree-ca-bundle.crt
RUN update-ca-certificates
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "Events.Api.dll"]
