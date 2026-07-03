using System.ComponentModel.DataAnnotations;

namespace Identity.Api.Dtos;

public record RegisterRequest(
    [Required, EmailAddress] string Email,
    [Required, MinLength(8)] string Password,
    [Required] string FirstName,
    [Required] string LastName);

public record RegisterResponse(Guid UserId, string Email, string FirstName, string LastName);

public record LoginRequest(
    [Required, EmailAddress] string Email,
    [Required] string Password);

public record UserSummary(Guid UserId, string Email, string FirstName, string LastName, string[] Roles);

public record LoginResponse(string AccessToken, int ExpiresInSeconds, UserSummary User);

public record RefreshResponse(string AccessToken, int ExpiresInSeconds);

public record UpdateProfileRequest(
    [Required] string FirstName,
    [Required] string LastName,
    string? PhoneNumber);

public record UserProfileResponse(Guid UserId, string Email, string FirstName, string LastName, string? PhoneNumber, string[] Roles);

public record ErrorResponse(ErrorBody Error);
public record ErrorBody(string Code, string Message);
