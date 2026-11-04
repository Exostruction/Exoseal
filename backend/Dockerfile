FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS build
WORKDIR /src
COPY global.json ExoSeal.slnx* ExoSeal.sln* ./
COPY src/ src/
RUN dotnet publish src/ExoSeal.Api -c Release -o /out

FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine
# ICU: ohne gibt es keine Kulturen (en, de), Mehrsprachigkeit bräuchte sie.
RUN apk add --no-cache icu-libs icu-data-full
ENV DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false
WORKDIR /app
COPY --from=build /out .
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "ExoSeal.Api.dll"]
