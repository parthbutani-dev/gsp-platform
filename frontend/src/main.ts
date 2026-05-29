import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { credentialsInterceptor } from './app/core/http/credentials.interceptor';
import { csrfInterceptor } from './app/core/http/csrf.interceptor';
import { errorInterceptor } from './app/core/http/error.interceptor';

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([credentialsInterceptor, csrfInterceptor, errorInterceptor])
    ),
  ],
}).catch(console.error);
