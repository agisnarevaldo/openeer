declare global {
  namespace App {
    interface Locals {
      user?: {
        id: string;
        name: string;
        email: string;
        [key: string]: any;
      };
      session?: {
        id: string;
        userId: string;
        expiresAt: Date;
        [key: string]: any;
      };
    }
  }
}

export {};
