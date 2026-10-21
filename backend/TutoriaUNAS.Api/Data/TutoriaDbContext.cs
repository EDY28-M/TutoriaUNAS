using Microsoft.EntityFrameworkCore;

namespace TutoriaUNAS.Api.Data;

// No DbSet or institutional schema until official instruments and requirements exist.
public sealed class TutoriaDbContext(DbContextOptions<TutoriaDbContext> options) : DbContext(options);
