import { Component } from '@angular/core';
import { TimelineComponent } from './timeline/timeline.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [TimelineComponent],
  template: '<app-timeline></app-timeline>',
  styles: [':host { display: block; height: 100vh; }'],
})
export class App {}
