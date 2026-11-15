import { Component } from '@angular/core';
import { IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs } from '@ionic/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { addCircleOutline, businessOutline, homeOutline, medkitOutline } from 'ionicons/icons';

/** Bottom-tab layout of the public application. */
@Component({
  selector: 'app-shell',
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, TranslatePipe],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class Shell {
  constructor() {
    addIcons({ homeOutline, medkitOutline, businessOutline, addCircleOutline });
  }
}
