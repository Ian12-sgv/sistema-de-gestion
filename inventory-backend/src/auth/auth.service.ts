import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(private users: UsersService, private jwt: JwtService) {}

  async login(username: string, password: string) {
    const u = await this.users.validateCredentials(username, password);
    if (!u) throw new UnauthorizedException('Credenciales inválidas');

    const access_token = await this.jwt.signAsync({ sub: u.id });
    return { access_token, user: u };
  }
}