import { Webhook } from "svix";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/config/db";
import { Users } from "@/config/schema";
import { eq } from "drizzle-orm";

export async function POST(req) {
  const SIGNING_SECRET = process.env.SIGNING_SECRET;

  if (!SIGNING_SECRET) {
    throw new Error(
      "Error: Please add SIGNING_SECRET from Clerk Dashboard to .env or .env.local"
    );
  }

  // Create new Svix instance with secret
  const wh = new Webhook(SIGNING_SECRET);

  // Get headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Error: Missing Svix headers", {
      status: 400,
    });
  }

  // Get body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  let evt;

  // Verify payload with headers
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    });
  } catch (err) {
    console.error("Error: Could not verify webhook:", err);
    return new Response("Error: Verification error", {
      status: 400,
    });
  }

  // Do something with payload
  // For this guide, log payload to console
  const eventType = evt.type;

  if (eventType === "user.created") {
    return saveUser(
      evt.data.id,
      `${evt.data.first_name} ${evt.data.last_name}`,
      evt.data.email_addresses[0].email_address,
      evt.data.image_url
    );
  } else if (eventType === "user.updated") {
    return updateUser(
      `${evt.data.first_name} ${evt.data.last_name}`,
      evt.data.email_addresses[0].email_address,
      evt.data.image_url
    );
  } else if (eventType === "user.deleted") {
    return deleteUser(evt.data.id);
  }

  return new Response("Webhook received", { status: 200 });
}

async function saveUser(id, name, email, imageUrl) {
  // Save user to database
  try {
    await db.insert(Users).values({
      id,
      name,
      email,
      imageUrl,
    });

    return new NextResponse(
      { message: "User created" },
      {
        status: 201,
      }
    );
  } catch (error) {
    return new NextResponse({ error: error.message }, { status: 500 });
  }
}

async function updateUser(id, name, email, imageUrl) {
  // Update user in database
  try {
    await db
      .update(Users)
      .set({
        name,
        email,
        imageUrl,
      })
      .where(eq(Users.id, id));

    return new NextResponse(
      { message: "User updated" },
      {
        status: 200,
      }
    );
  } catch (error) {
    return new NextResponse({ error: error.message }, { status: 500 });
  }
}

async function deleteUser(id) {
  // Delete user from database
  try {
    await db.delete(Users).where(eq(Users.id, id));

    return new NextResponse(
      { message: "User deleted" },
      {
        status: 200,
      }
    );
  } catch (error) {
    return new NextResponse({ error: error.message }, { status: 500 });
  }
}
