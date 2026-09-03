import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions = {
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credenciales",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const usuario = await prisma.usuario.findUnique({
          where: { email: credentials.email },
          include: { departamento: { select: { id: true, slug: true, nombre: true } } },
        });
        if (!usuario) return null;

        const claveValida = await bcrypt.compare(credentials.password, usuario.passwordHash);
        if (!claveValida) return null;

        return {
          id: usuario.id,
          name: usuario.nombre,
          email: usuario.email,
          rol: usuario.rol,
          departamentoId: usuario.departamento.id,
          departamentoSlug: usuario.departamento.slug,
          departamentoNombre: usuario.departamento.nombre,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.rol = user.rol;
        token.id = user.id;
        token.departamentoId = user.departamentoId;
        token.departamentoSlug = user.departamentoSlug;
        token.departamentoNombre = user.departamentoNombre;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.rol = token.rol;
        session.user.id = token.id;
        session.user.departamentoId = token.departamentoId;
        session.user.departamentoSlug = token.departamentoSlug;
        session.user.departamentoNombre = token.departamentoNombre;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
