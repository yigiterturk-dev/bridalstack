import "next-auth";

// session.user.id kullanabilmek için NextAuth tiplerini genişletiyoruz.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
