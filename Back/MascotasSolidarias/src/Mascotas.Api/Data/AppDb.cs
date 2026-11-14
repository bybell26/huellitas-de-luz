using Mascotas.Api.Models;
using Microsoft.EntityFrameworkCore;
namespace Mascotas.Api.Data;
public class AppDb(DbContextOptions<AppDb> options) : DbContext(options)
{
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<WebhookReceipt> Receipts => Set<WebhookReceipt>();
    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Order>().HasKey(x=>x.Id);
        b.Entity<Order>().HasIndex(x=>x.QrId).IsUnique();
        b.Entity<WebhookReceipt>().HasKey(x=>x.Id);
        b.Entity<WebhookReceipt>().HasIndex(x=>x.TransactionId).IsUnique();
    }
}
