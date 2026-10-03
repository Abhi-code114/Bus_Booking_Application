using {cuid,temporal} from '@sap/cds/common';

namespace bus.booking;

aspect status {
    status : String(20) default 'available';
}



entity Buses : cuid, temporal, status {

    @assert.format: '^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{1,4}$'
    busNumber : String(20);

    source : String(100);

    destination : String(100);

    busType : String(50);

    departureDateTime : Timestamp;

    arrivalDateTime : Timestamp;

    seats : Composition of many Seats
        on seats.bus = $self;

    bookings : Association to many Bookings
        on bookings.bus = $self;
}




entity Seats : cuid, status {

    seatNo : String(10) ;

    amount : Decimal(10,2);

    seatType : String(30);

    bus : Association to one Buses;

    bookings : Association to many Bookings
        on bookings.seat = $self;
}




entity Passengers : cuid {

    name : String(100);

    @assert.range: [0,110]
    age : Integer ;

    email : String(150);

    @assert.format: '^[6-9][0-9]{9}$'
    mobile : String(10);

    bookings : Association to many Bookings
        on bookings.passenger = $self;
}


entity Bookings : cuid {

    bus : Association to one Buses;

    seat : Association to one Seats;

    passenger : Association to one Passengers;

    bookingDateTime : Timestamp default $now;
}