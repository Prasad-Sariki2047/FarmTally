export class DateUtils {
  static addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60000);
  }

  static addHours(date: Date, hours: number): Date {
    return new Date(date.getTime() + hours * 3600000);
  }

  static addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * 86400000);
  }

  static isExpired(expiryDate: Date): boolean {
    return new Date() > expiryDate;
  }

  static formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  static formatDateTime(date: Date): string {
    return date.toISOString();
  }

  static parseDate(dateString: string): Date {
    return new Date(dateString);
  }

  static getTimestamp(): number {
    return Date.now();
  }

  static getDaysFromNow(days: number): Date {
    return this.addDays(new Date(), days);
  }

  static getHoursFromNow(hours: number): Date {
    return this.addHours(new Date(), hours);
  }

  static getMinutesFromNow(minutes: number): Date {
    return this.addMinutes(new Date(), minutes);
  }
}