export class Logger {
  constructor(private serviceName: string, private id: string) {}

  log(message: string, ...additional: any[]) {
    console.log(
      '\n',
      this.serviceName,
      this.id,
      '\n',
      message,
      '\n',
      ...additional,
    );
  }

  logStart(message: string) {
    console.log('\n\n');
    console.log('############################################################');
    console.log(message, this.serviceName, this.id);
  }
}
