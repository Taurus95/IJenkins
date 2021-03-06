'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { isUndefined } from 'util';
import * as WebRequest from 'web-request';


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "jint" is now active!');

    //global variables while the extension is active
    //put here your jenkins url
    var URL: any = '';
    var USER: any;
    var PASS: any;
    var LAST_VIEW: any;
    var LAST_JOB: any;
    var CRUMB: JSON;

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    vscode.commands.registerCommand('extension.configJenkinsCredentials', async () => {
        //user and token for jenkins

        if (isUndefined(URL) || URL === '') {
            vscode.window.showWarningMessage('You need set up an url first!');
            vscode.commands.executeCommand('extension.changeURL');
            return;
        }

        USER = await vscode.window.showInputBox({ placeHolder: 'User' });
        PASS = await vscode.window.showInputBox({ password: true, placeHolder: 'Password' });

        if (USER === '' || PASS === '') {
            vscode.window.showErrorMessage('Error, user or pass null');
            USER = '';
            PASS = '';
            return;
        } if (isUndefined(USER) || isUndefined(PASS)) {
            vscode.window.showErrorMessage('Error, user or pass undefined');
            USER = '';
            PASS = '';
            return;
        } else {

            vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Checking...' }, p => {
                return new Promise(async (resolve, reject) => {
                    if (await checkUserConnection(USER, PASS, URL)) {
                        //if conect with the credentials all is ok for next connections
                        CRUMB = await searchCrumb(USER, PASS, URL);
                        console.log('CRUMB object: ' + JSON.stringify(CRUMB));
                        resolve();
                        vscode.window.showInformationMessage('Account configured!');

                    } else {

                        resolve();
                        vscode.window.showErrorMessage('Problems with your account, try set up it again!');
                        USER = '';
                        PASS = '';

                    }
                });
            });
        }
    });

    vscode.commands.registerCommand('extension.excecuteJenkinsJob', async () => {
        //excecute a jenkins job

        //check if is a account config
        if (!checkConfigCredentials(USER, PASS, URL)) {
            vscode.window.showWarningMessage('You need set up url and credentials first!');
            vscode.commands.executeCommand('extension.configJenkinsCredentials');
            return;
        }

        //select the view
        LAST_VIEW = await vscode.window.showQuickPick(listViews(USER, PASS, URL), { placeHolder: 'Select a view' });

        if (isUndefined(LAST_VIEW)) {
            vscode.window.showErrorMessage('View is undefined, start again!');
            return;
        }

        //select the job
        LAST_JOB = await vscode.window.showQuickPick(listJobs(LAST_VIEW, USER, PASS, URL), { placeHolder: 'Select a job for excecute' });

        if (isUndefined(LAST_JOB)) {
            vscode.window.showErrorMessage('Job is undefine, start again!');
            return;
        }

        //confirm the excecute
        var confirm = await vscode.window.showInputBox({ placeHolder: "Write 'yes' for excecute " + LAST_VIEW + '->' + LAST_JOB });


        if (confirm === 'yes') {
            vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Building...' }, p => {
                return new Promise(async (resolve, reject) => {
                    if (await excecuteJob(LAST_VIEW, LAST_JOB, USER, PASS, URL, CRUMB)) {
                        //esperar a que termine el trabajo ejecutado
                        await checkFinishLast(USER, PASS, URL, LAST_JOB);
                        //termino de ejecucion
                        vscode.window.showInformationMessage('Job excecuted!');
                        resolve();

                    } else {
                        vscode.window.showErrorMessage('we have a problem excecuting the job :(');
                        resolve();

                    }
                });
            });

        } else {
            vscode.window.showInformationMessage('Canceled!');
        }

    });

    vscode.commands.registerCommand('extension.excecuteLastJenkinsJob', async () => {
        //check if is a account config
        if (!checkConfigCredentials(USER, PASS, URL)) {
            vscode.window.showWarningMessage('You need set up url and credentials first!');
            vscode.commands.executeCommand('extension.configJenkinsCredentials');
            return;
        }


        //confirm the excecute
        var confirm = await vscode.window.showInputBox({ placeHolder: "Write 'yes' for excecute " + LAST_VIEW + '->' + LAST_JOB });

        if (confirm === 'yes') {
            vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Building...' }, p => {
                return new Promise(async (resolve, reject) => {
                    if (await excecuteJob(LAST_VIEW, LAST_JOB, USER, PASS, URL, CRUMB)) {
                        //esperar a que termine el trabajo ejecutado
                        await checkFinishLast(USER, PASS, URL, LAST_JOB);
                        //termino de ejecucion
                        vscode.window.showInformationMessage('Job excecuted!');
                        resolve();

                    } else {
                        vscode.window.showErrorMessage('we have a problem excecuting the job :(');
                        resolve();

                    }
                });
            });
        } else {
            vscode.window.showInformationMessage('Canceled!');
        }

    });


    vscode.commands.registerCommand('extension.changeURL', async () => {

        //confirm the excecute
        var newUrl = await vscode.window.showInputBox({ placeHolder: "Write the jenkins URL like that 'http://jenkins:8080'" });
        if (isUndefined(newUrl)) {
            vscode.window.showInformationMessage('You need to put a correct url');
            return;
        } else {
            vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Checking...' }, p => {
                return new Promise(async (resolve, reject) => {
                    if (await checkUrlConnection(newUrl)) {
                        URL = newUrl;
                        vscode.window.showInformationMessage('New url configureD!');
                        vscode.commands.executeCommand('extension.configJenkinsCredentials');
                        resolve();
                    } else {
                        vscode.window.showInformationMessage('We dont have response from this url, set up again!');
                        resolve();
                    }
                });
            });

        }
    });

    //context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {
    console.log('jint deactivated, bye!');
}


async function checkUserConnection(user: any, pass: any, url: any): Promise<boolean> {
    //try to connect with the credentials
    var response = await WebRequest.get(url, {
        auth: {
            user: user,
            pass: pass
        }
    });
    //response of jenkins
    var statusCode = await response.statusCode;

    if (statusCode === 200) {
        console.log('status code: 200, correct credentialas!');
        return true;
    } else if (statusCode === 401) {
        console.log('status code: 401, bad credentials!');
        return false;
    }
    console.log('Status code: ' + statusCode);
    return false;
}

async function listViews(user: any, pass: any, url: any): Promise<string[]> {
    //here we need to go to search for the views
    //try to connect with the credentials
    var list = [];
    var response = await WebRequest.get(url + '/api/json?pretty=true', {
        auth: {
            user: user,
            pass: pass
        }
    });
    //wait for the response
    // var statusCode = await response.statusCode;

    var json = JSON.parse(await response.content);
    var views = json.views;

    //add views to the list
    for (let view of views) {
        list.push(view.name);
        console.log('vista : ' + view.name);
    }

    return list;
}

async function listJobs(view: any, user: any, pass: any, url: any): Promise<string[]> {
    //here we need to go to search for the views
    //try to connect with the credentials
    var list = [];
    var response = await WebRequest.get(url + '/view/' + view + '/api/json?pretty=true', {
        auth: {
            user: user,
            pass: pass
        }
    });
    //wait for the response
    // var statusCode = await response.statusCode;

    var json = JSON.parse(await response.content);
    var jobs = json.jobs;

    //add jobst to the list
    for (let job of jobs) {
        list.push(job.name);
        console.log('job : ' + job.name);
    }

    return list;
}

async function excecuteJob(view: any, job: any, user: string, pass: string, url: string, crumb: any): Promise<boolean> {

    var response = await WebRequest.post(url + '/job/' + job + '/build', {
        auth: {
            user: user,
            pass: pass
        },
        headers: {
            "Jenkins-Crumb": crumb.crumb
        }

    });

    var statusCode = await response.statusCode;
    console.log('status code of jenkins excecution: ' + statusCode);
    console.log('body of response: ' + response.content);

    if (statusCode === 200) {
        return true;
    } else if (statusCode === 201) {
        return true;
    }
    return false;
}

function checkConfigCredentials(user: string, pass: string, url: string): boolean {
    if (user === '' || pass === '' || isUndefined(user) ||
        isUndefined(pass) || url === '' || isUndefined(url)) {
        return false;
    }
    return true;
}

async function searchCrumb(user: string, pass: string, url: string): Promise<JSON> {
    var response = await WebRequest.get(url + '/crumbIssuer/api/json', {
        auth: {
            user: user,
            pass: pass
        }
    });

    //return the Crumb json
    return await JSON.parse(response.content);

}

async function checkFinishLast(user: string, pass: string, url: string, job: string): Promise<boolean> {
    var aux: number = 0;
    do {
        await delay(5000);
        var response = await WebRequest.get(url + '/job/' + job + '/lastBuild/api/json', {
            auth: {
                user: user,
                pass: pass
            }
        });

        var jsonResponse = JSON.parse(response.content);

        console.log('construyendo: ' + jsonResponse.building);

        if (jsonResponse.building === false) {

            vscode.window.showInformationMessage('Resultado: ' + jsonResponse.result);
            return true;

        }
        aux += 1;

    } while (aux < 60);
    return false;
}

function delay(milliseconds: number) {
    return new Promise<void>(resolve => {
        setTimeout(resolve, milliseconds);
    });
}

async function checkUrlConnection(url: any): Promise<boolean> {
    console.log("probando url");
    //try to connect to the new url
    try {
        await WebRequest.get(url);
        return true;
    } catch (error) {
        console.log("Error obteniendo el get");
        return false;
    }

}
