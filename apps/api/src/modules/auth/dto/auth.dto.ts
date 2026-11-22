import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Укажите корректный email' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Пароль должен содержать минимум 8 символов' })
  @MaxLength(128)
  password: string;

  @IsString()
  @MinLength(2, { message: 'Имя должно содержать минимум 2 символа' })
  @MaxLength(64)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceName?: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'Укажите корректный email' })
  email: string;

  @IsString()
  @MinLength(1, { message: 'Введите пароль' })
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceName?: string;
}

export class RefreshTokenDto {
  @IsString()
  @MinLength(16)
  refreshToken: string;
}

export class LogoutDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Укажите корректный email' })
  email: string;
}

export class ResetPasswordDto {
  @IsEmail({}, { message: 'Укажите корректный email' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'Введите 6-значный код восстановления' })
  @MaxLength(32)
  code: string;

  @IsString()
  @MinLength(8, { message: 'Новый пароль должен содержать минимум 8 символов' })
  @MaxLength(128)
  newPassword: string;
}
