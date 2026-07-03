
using System.Data.Common;
using Npgsql;
using Our.Umbraco.PostgreSql;

// Umbraco resolves its DB provider by ADO.NET invariant name ("Npgsql") at boot — this
// must be registered before CreateUmbracoBuilder() runs, or it fails with
// "invariant name 'Npgsql' wasn't found in the list of registered .NET Data Providers."
DbProviderFactories.RegisterFactory("Npgsql", NpgsqlFactory.Instance);

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

builder.CreateUmbracoBuilder()
    .AddBackOffice()
    .AddWebsite()
    .AddDeliveryApi()
    .AddComposers()
    .AddUmbracoPostgreSqlSupport()
    .Build();

WebApplication app = builder.Build();


await app.BootUmbracoAsync();


app.UseUmbraco()
    .WithMiddleware(u =>
    {
        u.UseBackOffice();
        u.UseWebsite();
    })
    .WithEndpoints(u =>
    {
        u.UseBackOfficeEndpoints();
        u.UseWebsiteEndpoints();
    });

await app.RunAsync();
