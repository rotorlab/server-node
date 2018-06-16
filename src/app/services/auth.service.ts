import { Injectable } from '@angular/core';

import { AngularFireAuth } from 'angularfire2/auth';
import * as firebase from 'firebase/app';

import { Observable } from 'rxjs/Observable';
import { Router } from "@angular/router";
import {HttpClient, HttpErrorResponse} from "@angular/common/http";

@Injectable()
export class AuthService {

    user$: Observable<firebase.User>;

    constructor(private _router: Router, private firebaseAuth: AngularFireAuth, private httpService: HttpClient) {
        this.user$ = firebaseAuth.authState;

        this.httpService.get('./assets/config.json').subscribe(
            data => {
                console.log("config.json: " + JSON.stringify(data))
                firebase.auth().onAuthStateChanged(function (user) {
                    if (!user) {
                        _router.navigate(["login"])
                    } else if (user && _router.url === "/login") {

                        _router.navigate(["home"])
                    }
              });
            },
            (err: HttpErrorResponse) => {
                if (err.message.indexOf("404 Not Found") > -1)
                    console.log ("config file not found on /src/assets");
                _router.navigate(["login"])
            }
        );

    }

    login() {
        this.firebaseAuth.auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
    }

    logout() {
        this.firebaseAuth.auth.signOut();
    }
}
