using { bus.booking as db } from '../db/schema';

service BusBookingService {

    entity Buses as projection on db.Buses;

    entity Seats as projection on db.Seats {
        *,
        bus,
        bus.busNumber as BusNumber
    };

    entity Passengers as projection on db.Passengers;

    entity Bookings as projection on db.Bookings;

    function getBuses() returns Integer;
}