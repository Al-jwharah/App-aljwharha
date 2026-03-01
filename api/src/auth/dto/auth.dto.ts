import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class RegisterDto {
    @IsEmail({}, { message: 'البريد الإلكتروني غير صالح' })
    email: string;

    @IsString()
    @MinLength(8, { message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' })
    @MaxLength(128)
    password: string;

    @IsString()
    @MinLength(2)
    @MaxLength(255)
    name: string;
}

export class LoginDto {
    @IsEmail({}, { message: 'البريد الإلكتروني غير صالح' })
    email: string;

    @IsString()
    @MinLength(1)
    password: string;
}

export class RefreshDto {
    @IsString()
    @MinLength(1)
    refreshToken: string;
}

export class LogoutDto {
    @IsString()
    @MinLength(1)
    refreshToken: string;
}
