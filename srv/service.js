const cds = require('@sap/cds');

const {
    SELECT,
    INSERT,
    UPDATE
} = cds.ql;



function getIndianDateTime() {

    const now = new Date();

    // Convert UTC milliseconds to IST milliseconds
    const indianMilliseconds =
        now.getTime() + (5 * 60 * 60 * 1000) + (30 * 60 * 1000);

    return new Date(indianMilliseconds);
}



module.exports = cds.service.impl(function () {

    const {
        Buses,
        Seats,
        Passengers,
        Bookings
    } = this.entities;



    this.on('getBuses', async () => {

        const result = await SELECT.one
            .from(Buses)
            .columns('count(*) as count');

        return Number(result.count);
    });


    /*
     * ========================================================
     * CREATE BUS VALIDATION
     * ========================================================
     */

    this.before('CREATE', Buses, async (req) => {

        const {
            busNumber,
            source,
            destination,
            departureDateTime,
            arrivalDateTime
        } = req.data;


        /*
         * Bus number duplicate check
         */

        if (busNumber) {

            const existingBus = await SELECT.one
                .from(Buses)
                .where({ busNumber });

            if (existingBus) {
                return req.reject(
                    409,
                    `Bus number ${busNumber} already exists.`
                );
            }
        }


        /*
         * Source and destination cannot be same
         */

        if (
            source &&
            destination &&
            source.trim().toLowerCase() ===
            destination.trim().toLowerCase()
        ) {
            return req.reject(
                400,
                'Bus source and destination cannot be the same.'
            );
        }


        /*
         * Arrival time must be greater than departure time
         */

        if (departureDateTime && arrivalDateTime) {

            const departure = new Date(departureDateTime);
            const arrival = new Date(arrivalDateTime);

            if (arrival <= departure) {

                return req.reject(
                    400,
                    'Arrival time must be greater than departure time.'
                );
            }
        }


        /*
         * Make sure new bus starts as available
         */

        req.data.status = 'available';
    });


    /*
     * ========================================================
     * CREATE SEAT VALIDATION
     * ========================================================
     */

    this.before('CREATE', Seats, async (req) => {

        const {
            bus_ID,
            seatNo,
            amount
        } = req.data;


        /*
         * Bus must be supplied
         */

        if (!bus_ID) {

            return req.reject(
                400,
                'Bus ID is required for creating a seat.'
            );
        }


        /*
         * Check bus exists
         */

        const bus = await SELECT.one
            .from(Buses)
            .where({ ID: bus_ID });

        if (!bus) {

            return req.reject(
                404,
                `Bus ${bus_ID} does not exist.`
            );
        }


        /*
         * Seat number must be unique inside a bus
         */

        const existingSeat = await SELECT.one
            .from(Seats)
            .where({
                bus_ID,
                seatNo
            });

        if (existingSeat) {

            return req.reject(
                409,
                `Seat ${seatNo} already exists for this bus.`
            );
        }


        /*
         * Amount cannot be negative
         */

        if (amount !== undefined && Number(amount) < 0) {

            return req.reject(
                400,
                'Seat amount cannot be negative.'
            );
        }


        /*
         * New seat is always available
         */

        req.data.status = 'available';
    });


    /*
     * ========================================================
     * CREATE PASSENGER VALIDATION
     * ========================================================
     */

    this.before('CREATE', Passengers, async (req) => {

        const {
            email,
            mobile
        } = req.data;


        /*
         * Duplicate email
         */

        if (email) {

            const existingEmail = await SELECT.one
                .from(Passengers)
                .where({ email });

            if (existingEmail) {

                return req.reject(
                    409,
                    `Passenger with email ${email} already exists.`
                );
            }
        }


        /*
         * Duplicate mobile
         */

        if (mobile) {

            const existingMobile = await SELECT.one
                .from(Passengers)
                .where({ mobile });

            if (existingMobile) {

                return req.reject(
                    409,
                    `Passenger with mobile ${mobile} already exists.`
                );
            }
        }
    });


    /*
     * ========================================================
     * CREATE BOOKING
     * ========================================================
     *
     * This is the most important business logic.
     *
     * ========================================================
     */

    this.before('CREATE', Bookings, async (req) => {

        const {
            bus_ID,
            seat_ID,
            passenger_ID
        } = req.data;


        /*
         * ----------------------------------------------------
         * 1. Check Bus ID
         * ----------------------------------------------------
         */

        if (!bus_ID) {

            return req.reject(
                400,
                'Bus ID is required.'
            );
        }


        /*
         * ----------------------------------------------------
         * 2. Check Seat ID
         * ----------------------------------------------------
         */

        if (!seat_ID) {

            return req.reject(
                400,
                'Seat ID is required.'
            );
        }


        /*
         * ----------------------------------------------------
         * 3. Check Passenger ID
         * ----------------------------------------------------
         */

        if (!passenger_ID) {

            return req.reject(
                400,
                'Passenger ID is required.'
            );
        }


        /*
         * ----------------------------------------------------
         * 4. Check Bus exists
         * ----------------------------------------------------
         */

        const bus = await SELECT.one
            .from(Buses)
            .where({ ID: bus_ID });

        if (!bus) {

            return req.reject(
                404,
                `Bus ${bus_ID} does not exist.`
            );
        }


        /*
         * ----------------------------------------------------
         * 5. Check Seat exists
         * ----------------------------------------------------
         */

        const seat = await SELECT.one
            .from(Seats)
            .where({ ID: seat_ID });

        if (!seat) {

            return req.reject(
                404,
                `Seat ${seat_ID} does not exist.`
            );
        }


        /*
         * ----------------------------------------------------
         * 6. Check Passenger exists
         * ----------------------------------------------------
         */

        const passenger = await SELECT.one
            .from(Passengers)
            .where({ ID: passenger_ID });

        if (!passenger) {

            return req.reject(
                404,
                `Passenger ${passenger_ID} does not exist.`
            );
        }


        /*
         * ----------------------------------------------------
         * 7. IMPORTANT:
         *    Check whether seat belongs to this bus
         * ----------------------------------------------------
         */

        if (seat.bus_ID !== bus_ID) {

            return req.reject(
                400,
                `Seat ${seat.seatNo} does not belong to bus ${bus.busNumber}.`
            );
        }


        /*
         * ----------------------------------------------------
         * 8. Check whether bus has already started
         * ----------------------------------------------------
         */

        if (bus.departureDateTime) {

            const currentIndianTime = getIndianDateTime();

            const busDepartureTime =
                new Date(
                    new Date(bus.departureDateTime).getTime()
                    + (5 * 60 * 60 * 1000)
                    + (30 * 60 * 1000)
                );


            if (currentIndianTime >= busDepartureTime) {

                return req.reject(
                    400,
                    `Bus ${bus.busNumber} has already started. Booking is not allowed.`
                );
            }
        }


        /*
         * ----------------------------------------------------
         * 9. Check seat status
         * ----------------------------------------------------
         */

        if (
            seat.status &&
            seat.status.toLowerCase() === 'booked'
        ) {

            return req.reject(
                409,
                `Seat ${seat.seatNo} is already booked for bus ${bus.busNumber}.`
            );
        }


        /*
         * ----------------------------------------------------
         * 10. Check duplicate bus + seat booking
         * ----------------------------------------------------
         */

        const existingSeatBooking = await SELECT.one
            .from(Bookings)
            .where({
                bus_ID,
                seat_ID
            });

        if (existingSeatBooking) {

            return req.reject(
                409,
                `Seat ${seat.seatNo} is already booked for this bus.`
            );
        }


        /*
         * ----------------------------------------------------
         * 11. Check duplicate passenger + bus + seat
         * ----------------------------------------------------
         */

        const existingPassengerBooking = await SELECT.one
            .from(Bookings)
            .where({
                bus_ID,
                seat_ID,
                passenger_ID
            });

        if (existingPassengerBooking) {

            return req.reject(
                409,
                'This passenger has already booked this seat on this bus.'
            );
        }


        /*
         * ----------------------------------------------------
         * 12. Count all seats of the bus
         * ----------------------------------------------------
         */

        const totalSeatsResult = await SELECT.one
            .from(Seats)
            .columns('count(*) as count')
            .where({ bus_ID });

        const totalSeats =
            Number(totalSeatsResult.count);


        /*
         * ----------------------------------------------------
         * 13. Count already booked seats
         * ----------------------------------------------------
         */

        const bookedSeatsResult = await SELECT.one
            .from(Bookings)
            .columns('count(*) as count')
            .where({ bus_ID });

        const bookedSeats =
            Number(bookedSeatsResult.count);


        /*
         * ----------------------------------------------------
         * 14. Check whether all seats are already booked
         * ----------------------------------------------------
         */

        if (
            totalSeats > 0 &&
            bookedSeats >= totalSeats
        ) {

            return req.reject(
                409,
                `No more seats are available on bus ${bus.busNumber}.`
            );
        }


        /*
         * ----------------------------------------------------
         * 15. Booking date/time
         * ----------------------------------------------------
         */

        req.data.bookingDateTime =
            new Date().toISOString();


        /*
         * ----------------------------------------------------
         * 16. UPDATE SEAT STATUS
         * ----------------------------------------------------
         *
         * Seat:
         * available -> booked
         *
         * ----------------------------------------------------
         */

        await UPDATE(Seats)
            .set({
                status: 'booked'
            })
            .where({
                ID: seat_ID
            });

        console.log('----------------------------------');
        console.log('SEAT STATUS UPDATED');
        console.log('BUS ID:', bus_ID);
        console.log('SEAT ID:', seat_ID);
        console.log('SEAT STATUS: booked');


        /*
         * ----------------------------------------------------
         * 17. CHECK ACTUAL AVAILABLE SEATS
         * ----------------------------------------------------
         *
         * We check the Seat entity directly.
         *
         * ----------------------------------------------------
         */

        const availableSeatResult = await SELECT.one
            .from(Seats)
            .columns('count(*) as count')
            .where({
                bus_ID,
                status: 'available'
            });

        const availableSeats =
            Number(availableSeatResult.count);

        console.log('AVAILABLE SEATS:', availableSeats);


        /*
         * ----------------------------------------------------
         * 18. UPDATE BUS STATUS
         * ----------------------------------------------------
         *
         * If no available seats remain:
         *
         *     Bus = booked
         *
         * Otherwise:
         *
         *     Bus = available
         *
         * ----------------------------------------------------
         */

        if (availableSeats === 0) {

            await UPDATE(Buses)
                .set({
                    status: 'booked'
                })
                .where({
                    ID: bus_ID
                });

            console.log('BUS STATUS UPDATED TO BOOKED');

        } else {

            await UPDATE(Buses)
                .set({
                    status: 'available'
                })
                .where({
                    ID: bus_ID
                });

            console.log('BUS STATUS UPDATED TO AVAILABLE');
        }

        console.log('----------------------------------');
    });


    /*
     * ========================================================
     * DELETE BOOKING
     * ========================================================
     *
     * When booking is deleted:
     *
     * Seat -> available
     *
     * Bus -> recalculated from actual Seat statuses
     *
     * ========================================================
     */

    this.before('DELETE', Bookings, async (req) => {

        const bookingID =
            req.data.ID;


        if (!bookingID) {

            return req.reject(
                400,
                'Booking ID is required.'
            );
        }


        /*
         * Find booking before deleting it.
         */

        const booking = await SELECT.one
            .from(Bookings)
            .where({
                ID: bookingID
            });

        if (!booking) {

            return req.reject(
                404,
                `Booking ${bookingID} does not exist.`
            );
        }


        /*
         * Store details so after deletion
         * we can update Seat and Bus status.
         */

        req._deletedBooking = booking;
    });


    /*
     * ========================================================
     * AFTER DELETE BOOKING
     * ========================================================
     */

    this.after('DELETE', Bookings, async (result, req) => {

        const booking =
            req._deletedBooking;


        if (!booking) {
            return;
        }


        const {
            bus_ID,
            seat_ID
        } = booking;


        /*
         * ----------------------------------------------------
         * Check whether another booking still uses this seat
         * ----------------------------------------------------
         */

        const remainingSeatBooking =
            await SELECT.one
                .from(Bookings)
                .where({
                    bus_ID,
                    seat_ID
                });


        /*
         * If no booking exists for the seat,
         * make the seat available.
         */

        if (!remainingSeatBooking) {

            await UPDATE(Seats)
                .set({
                    status: 'available'
                })
                .where({
                    ID: seat_ID
                });

            console.log('SEAT STATUS UPDATED TO AVAILABLE');
        }


        /*
         * ----------------------------------------------------
         * CHECK ACTUAL AVAILABLE SEATS
         * ----------------------------------------------------
         */

        const availableSeatResult = await SELECT.one
            .from(Seats)
            .columns('count(*) as count')
            .where({
                bus_ID,
                status: 'available'
            });

        const availableSeats =
            Number(availableSeatResult.count);

        console.log('AVAILABLE SEATS AFTER DELETE:', availableSeats);


        /*
         * ----------------------------------------------------
         * UPDATE BUS STATUS
         * ----------------------------------------------------
         */

        if (availableSeats === 0) {

            await UPDATE(Buses)
                .set({
                    status: 'Booked'
                })
                .where({
                    ID: bus_ID
                });

            console.log('BUS STATUS UPDATED TO BOOKED');

        } else {

            await UPDATE(Buses)
                .set({
                    status: 'available'
                })
                .where({
                    ID: bus_ID
                });

            console.log('BUS STATUS UPDATED TO AVAILABLE');
        }
    });

});